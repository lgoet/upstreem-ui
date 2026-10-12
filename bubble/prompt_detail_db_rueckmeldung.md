# Rückmeldung an den Datenbank-Chat: Prompt Detail v1 (12.10.2026)

Diesen Text in den Datenbank-Chat geben. Kurz gesagt: **Die Lieferung ist angenommen.** Der Drawer
läuft gegen die echten Antworten aus `prompt_detail_v1_echte_antworten.json`, ohne Änderung an
deiner Seite. Zwei Fragen sind offen (Abschnitt 3).

## 1. Was der Drawer jetzt aus deiner Lieferung nimmt

| Teil | Quelle | Gemessen (Prüfstand drw04, echte Antworten) |
|---|---|---|
| Meta-Zeile | `prompt_detail_v1.row`: `market`, `tags[]` (Farbe aus `hex_light`/`hex_dark`), `status`, `paused_reason`, `last_run_at`, `next_run_at` | „DE, Familycar, Safety, Sedans, Last run 19 hours ago“. Im Tooltip steht der genaue Zeitpunkt und beim aktiven Prompt der nächste Lauf. Der pausierte Prompt zeigt „Paused“ vor dem letzten Lauf, bei `plan_limit` „Paused (plan limit reached)“. |
| Titel | `row.prompt_text` | vollständig |
| Kennzahlen | `cached_dashboard_overview_v1(…, p_prompt_id).own` | Visibility 72.2 % (↘ 5.6 %), Avg. Rank 3.3 (↘ 0.3, grün, weil umgekehrt), Sentiment 83 (↘ 2) |
| Chart, Top Citations, Responses | dieselben RPCs wie Dashboard und Citations, mit `p_prompt_id` | 5 Anfragen, alle mit `p_prompt_id`, Zeitraum und `p_models`; `p_markets` und `p_tag_ids` sind `null` |
| Export der Tabelle | `export_type: prompt_runs`, `prompt_id` | `prompt_id` ist im Kontext. Bubble reicht es als `p_prompt_id` an `export_responses_v1` weiter. |

**Ohne Läufe im Zeitraum** (pausierter Prompt `b0ac…`):
- Die Kennzahlenleiste zeigt „This prompt didn't run in the selected period.“ Gelesen wird das an `meta.runs_total = 0` der Overview.
- Chart und Citations zeigen ihren Leerzustand.
- Die Tabelle zeigt denselben Satz statt „Responses appear here once your prompts have been run“.
- Es erscheint kein Fehler.

**Fehler** (`prompt_detail_v1`, alle sieben Formen aus der Datei):
- `prompt_not_found` wird zu „This prompt no longer exists.“, auf Deutsch dein Wortlaut „Dieser Prompt existiert nicht mehr.“
- `team_invalid_param` zeigt denselben Satz, weil die kaputte ID aus einem Link kommt.
- `team_access_<state>`, `team_forbidden`, `team_deleted` und `settings_not_authenticated` haben je einen eigenen Satz und keinen „Try again“-Knopf.
- `prompt_rate_limited` zeigt einen Satz mit „Try again“.
- Bei jedem Fehler steht nur die Meldung da, kein leerer Chart darunter.

## 2. Was der Drawer NICHT nimmt (bewusst)

- **`row.models`:** Der Modellfilter zeigt die Modelle des Teams aus dem Store der App. Laut deiner Beschreibung ist das dieselbe Liste. Ein zweiter Weg zur gleichen Liste wäre eine zweite Wahrheit.
- **`hint` beim Ratenlimit:** Wir zeigen „Please wait a moment“ statt der Sekunden. Bei 120 Aufrufen pro Minute trifft das niemand, der nicht klickt wie ein Skript.
- **`meta.data_as_of`:** Er wird nicht angezeigt. Der Kopf hat keinen Zeitraum, und „Last run“ sagt dasselbe genauer.

## 3. Zwei Fragen

1. **`pruefung_C.overview_own_visibility_7` ist `null`, der Fall „overview (7 Tage)“ liefert aber
   `own.visibility_pct = 72.22`.** Das passt zu `runs_total` 18 und `own.mentions` 13 (13/18 = 72.2 %).
   Ich vermute, die Prüfabfrage las einen anderen Pfad, etwa `own.visibility` statt `own.visibility_pct`.
   Bitte bestätigen, dass die Overview mit `p_prompt_id` `own.visibility_pct` immer füllt, sobald
   der Prompt im Zeitraum lief.
2. **Overview und Visibility ohne Läufe:** In der Datei stehen für `b0ac…` nur Zählungen
   (`responses_total`, das `meta` der Domains). Im Prüfstand habe ich die leeren Antworten daraus
   abgeleitet: echtes `meta`, keine Zeilen, `runs_total` 0, die Werte in `own` `null`. Bitte einmal
   die echte Overview für `b0ac…` (7 Tage) nachreichen. Konkret: Ist `own` dann ein Objekt mit
   `null`-Werten, `null` oder fehlt es ganz? Der Drawer verträgt alle drei Formen, aber geprüft
   ist nur die erste.
   **Erledigt durch `prompt_detail_v1_nachtrag_ohne_laeufe.json`:** `own` ist ein Objekt mit `null`-Werten,
   `runs_total` 0. Genau diese Form war geprüft.

## 4. Laufzeiten

Deine Zahlen (kalt 25 ms bis 1,6 s) passen. Der Drawer schickt alle sechs Anfragen gleichzeitig.
Die Domains-Liste mit 1,6 s ist also die längste Wartezeit, und die übrigen Teile stehen vorher da.
Die Kennzahlen kommen aus der Overview, die der Chart ohnehin lädt. Dafür gibt es **keinen**
zusätzlichen Aufruf.

`get_prompt_detail_bundle_v6` bleibt, bis Lukas die Bubble-Gruppe `drawer-prompt` gelöscht hat.
Danach melde ich mich, und v6 kann weg.
