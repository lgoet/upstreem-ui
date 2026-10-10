# An den Datenbank-Chat: Missbrauchs- und Fehlertests Prompt Insights v1 (10.10.2026)

Prompt Insights v1 ist live und die Oberfläche ist gegen deine echten Antworten geprüft. Diese
Runde ist ein **Angriffstest**. Bitte jeden Fall in einer **zurückgerollten Transaktion** (bzw. mit
einem Testteam) ausführen und je Fall **Ergebnis, Antwort, Laufzeit** schicken. Ändern bitte nur, wo
ein Test scheitert, und den Fix dann mit Vorher/Nachher belegen.

Die Oberfläche hält die Grenzen schon vorab ein (Länge 3–500, 100 je Anlage, 5 Topics, 60 Zeichen
Topic-Name, 10 Gruppierungen, 500 IDs, 1.000 Ziele, CSV bis 1 MB). **Das schützt nichts:** Jeder
angemeldete Nutzer kann mit seinem eigenen Token jede Funktion direkt aufrufen, mit jeder Nutzlast.
Gezählt wird also nur, was die Datenbank selbst abweist.

---

## 1. Fremde Teams (höchste Priorität)

Aufrufer ist ein `member` von Team A. Team B ist ein fremdes Team. Für **jede** Funktion:

| Test | erwartet |
|---|---|
| `p_team` = Team B | Fehler, keine Daten, keine Änderung |
| `p_team` = Team A, aber `p_ids` / `p_prompt_id` aus Team B | `prompts_not_found`, nichts geändert |
| gemischte Liste: 2 eigene IDs + 1 fremde | `prompts_not_found`, **auch die eigenen nicht** geändert |
| `p_tag_ids`, `p_add_tag_ids` mit Topic aus Team B | Fehler, nichts zugewiesen |
| `p_company_ids` mit Marke aus Team B | Fehler oder leer, keine Zahlen von Team B |
| `p_groups` mit Topic-IDs aus Team B | Topic in `dropped_tag_ids`, keine Zahlen von Team B |
| `topic_save_v1` mit `p_tag_id` aus Team B (Umbenennen) | Fehler, Topic von B unverändert |
| `prompts_purge_status_v1` mit `p_job_id` von Team B | Fehler, kein Status |
| Laufzeit: fremde ID gegen nicht existierende ID | gleich schnell (kein Rückschluss, ob es die ID gibt) |

Dazu bitte einmal mit `curl` und dem öffentlichen Schlüssel **ohne** Nutzertoken: jede Funktion muss
abweisen (`anon` hat kein Ausführungsrecht).

## 2. Kosten durch Hin und Her (Prompt-Läufe kosten Geld)

Jeder neu angelegte oder wieder aktivierte Prompt bekommt laut Vorschlag einen Lauf „fällig in 4
Minuten“. Das Planlimit begrenzt nur, wie viele **gleichzeitig** aktiv sind, nicht wie oft.

| Test | Frage |
|---|---|
| 50 Prompts aktivieren, sofort deaktivieren, wieder aktivieren, 10 Mal hintereinander | Wie viele Läufe entstehen? Darf es nicht mehr sein als ohne das Hin und Her. Bitte so bauen, dass Wiederaktivieren den nächsten Lauf nicht **vorzieht** (nach dem letzten Lauf und dem normalen Takt richten). |
| Anlegen, nach 5 Min. löschen, denselben Text neu anlegen, wiederholt | Läufe pro Stunde für dasselbe Team? Vorschlag: Tagesgrenze für neu angelegte bzw. aktivierte Prompts je Team (z. B. 2× Planlimit), Fehler `prompts_daily_limit_reached`. |
| 1.000 inaktive anlegen (Anlage, dann Deaktivieren), dann alle löschen, wiederholt | Last auf `prompt-purge-worker`, Wartezeit anderer Teams. Braucht es eine Grenze für Löschaufträge je Team und Tag? |

## 3. Unicode und Umgehung von Prüfungen

| Test | erwartet |
|---|---|
| Topic „SUV“ und „S​UV“ (Nullbreite), „ＳＵＶ“ (Vollbreite), „SUV “ mit geschütztem Leerzeichen | als **dasselbe** Topic erkannt (`topics_duplicate_name`). Vorschlag: Namen vor dem Vergleich NFKC-normalisieren und unsichtbare Zeichen entfernen, wie beim Prompt-Text. |
| Topic-Name aus 60 kombinierenden Zeichen („Zalgo“), RTL-Override U+202E, nur Leerzeichen | abgewiesen oder bereinigt |
| Emoji-Feld: 16 kombinierende Zeichen ohne Grundzeichen, `<script>`, `">`, ein Buchstabe mit Hautton | abgewiesen (`topics_invalid_param`) |
| Prompt-Text identisch bis auf Nullbreiten-Zeichen oder geschütztes Leerzeichen | als Dublette erkannt |
| Prompt-Text, der genau so lautet wie ein Grabstein eines gelöschten Prompts (`[deleted <id>] …`) | sauberes Ergebnis (angelegt oder `skipped`), **kein** 23505 / 500 |
| Prompt-Text mit `%`, `_`, `\`, `'` in der Suche | findet genau diesen Text, kein Fehler |

## 4. Übergroße und kaputte Nutzlasten

| Test | erwartet |
|---|---|
| `p_items` mit 101 Einträgen | `prompts_invalid_param` |
| `p_items` mit 100 Einträgen zu je 100.000 Zeichen | schnell `too_long` je Zeile (Laufzeit?), kein Speicherproblem |
| Anfrage-Körper von 10 MB | von PostgREST abgewiesen, bevor die Funktion läuft? Wo liegt die Grenze? |
| `p_items` = Objekt statt Liste, `text` = Zahl, `market` = Liste | `prompts_invalid_param`, kein 500 |
| `p_groups` mit 10.000 Gruppierungen bzw. 1 MB `key` | `prompts_invalid_param`, schnell |
| `p_tag_ids` mit 10.000 Einträgen, `p_ids` mit 100.000 | `prompts_invalid_param`, schnell |
| `p_limit` = -1, 0, 101, `p_offset` = -1, 1e12 | klare Fehler bzw. leere Liste, kein 500 |
| `p_date_from` = `0001-01-01`, `p_date_to` in 9999, `from > to` | `prompts_invalid_param` |
| `p_order`, `p_status`, `p_mode`, `p_action` mit unbekanntem Wert oder SQL-Text | `prompts_invalid_param` |
| `p_expected_count` fehlt, negativ, als Text | Fehler, nichts geändert |

## 5. Gleichzeitigkeit

| Test | erwartet |
|---|---|
| zwei Anlagen gleichzeitig, zusammen über dem Planlimit | genau eine gelingt, die andere `prompts_limit_reached`; Summe nie über dem Limit |
| Aktivieren und Anlage gleichzeitig | dasselbe |
| zweimal dieselbe Anlage gleichzeitig (Doppelklick) | keine Dubletten |
| Löschen und gleichzeitiges Aktivieren derselben Prompts | kein halber Zustand (Prompt gelöscht **und** aktiv) |
| Topic löschen, während ein `add_topics` es zuweist | keine verwaiste Zuordnung |
| Löschauftrag läuft, Prompt mit gleichem Text wird neu angelegt | neuer Prompt bleibt unberührt vom Aufräumen |

## 6. Ratenlimits

| Test | erwartet |
|---|---|
| 61 Lesezugriffe in einer Minute je Funktion | der 61. `prompts_rate_limited`, `hint` = Sekunden |
| derselbe Nutzer in zwei Teams | Grenze je Nutzer (nicht je Team umgehbar) |
| 31× `prompts_bulk_v1` in einer Minute | der 31. abgewiesen, **ohne** Änderung |
| Grenze trifft mitten in einer Sammelaktion | Aktion ganz oder gar nicht |

## 7. Hintergrundjob

| Test | erwartet |
|---|---|
| Teil `runs` bricht ab (z. B. Sperre durch einen laufenden Prompt-Lauf) | nächster Lauf setzt fort, nichts doppelt abgezogen; Prüfsumme danach 0 |
| fünf Fehlversuche | Status `error` mit Grund; Prompt bleibt unsichtbar, Zahlen konsistent |
| Kanal `prompt_purge_job:<job_id>` ist öffentlich | Enthält die Nutzlast etwas, das ein Fremder nicht sehen darf? (Job-IDs sind zufällig, aber bitte bestätigen, was darin steht.) |

## 8. Zurück an mich

Je Abschnitt eine Tabelle: Test, Ergebnis (bestanden/gescheitert), Antwort, Laufzeit. Für
Gescheitertes: Fix mit Vorher/Nachher. Für Abschnitt 2 eine Empfehlung mit Zahlen (Läufe pro
Stunde in den Tests). Grenzen, die die Oberfläche kennen muss (neue Fehler-`message`), bitte
ausdrücklich nennen, ich ziehe sie nach.
