# An den Datenbank-Chat: Rückmeldung Prompt Insights, 10.10.2026

Danke für die Bestandsaufnahme. Der Vorschlag passt zur Oberfläche: Sortierschlüssel, Blättern,
Status, Gruppen, Auswahl über Filter mit `p_expected_count`, Responses über
`cached_dashboard_responses_v1`. Unten stehen die Entscheidungen des Nutzers und die
Ergänzungen. **Mit diesen Änderungen bitte bauen.**

Hinweis zu deinem Punkt 8: Die Adresse `localhost:8099/…` steht nicht im Auftrag. Den Punkt bitte
ignorieren.

---

## 1. Entscheidungen des Nutzers

| Frage | Entscheidung |
|---|---|
| 7 Sicherheitsfix K1 | **Schon eingespielt** (vom Nutzer erledigt). Bitte einmal bestätigen, dass alle 19 Policies die neue Bedingung tragen. |
| 1 Rollen | Prompts löschen und Topics löschen: **nur `owner` und `admin`**. Alles andere (anlegen, aktivieren, deaktivieren, Topics zuweisen, Topics anlegen und bearbeiten) dürfen alle Mitglieder. |
| 2 Sonderzeichen | **Umschreiben und melden**, wie der Trigger heute: Backtick und Backslash weg, `${` wird `$ {`, Zeilenumbrüche und Steuerzeichen werden ein Leerzeichen. `rewritten = true` je Zeile. **Keine** Abweisung wegen `= + - @`: Plus, Minus, Bindestrich und Klammern sind normaler Inhalt (siehe 1a). |
| 3 Prompt löschen | **Wie Analyse-Tools üblich:** „Inaktiv“ ist das Pausieren und behält die Historie. „Löschen“ entfernt den Prompt **samt seiner Historie aus allen Auswertungen**, überall gleich (siehe 1b). |
| 4 Topic-Grenze | 50 je Team übernommen. |
| 5 Eigene Gruppierungen | Bleiben im Browser. |
| 6 `delete_prompts` | Für den Bau ohne Bedeutung, die neue Seite ruft `prompts_bulk_v1`. Für das Aufräumen bitte beide Fassungen (`_v2`, `_v3`) führen. |

### 1a. Formelschutz gehört in den Export

Die Gefahr besteht nur in einer CSV-Datei: Tabellenprogramme führen eine Zelle als Formel aus, wenn
sie mit `=`, `+`, `-`, `@`, Tab oder Wagenrücklauf **beginnt**. Im Prompt selbst ist das Zeichen
harmlos. Darum:

- `prompts_add_v1` legt solche Texte normal an. Der Grund `invalid_text` bleibt nur für Texte, die
  nach dem Bereinigen leer sind oder nur aus Leerzeichen bestehen.
- **Alle CSV-Exporte** (mindestens `export_prompts_full_v2` und die übrigen `export_*`, die Text
  aus Nutzer- oder Modellhand schreiben) stellen einer Zelle, die mit einem dieser Zeichen
  beginnt, ein `'` voran (Empfehlung der OWASP zu CSV Injection). Bitte als eigene kleine
  Änderung mitliefern und in der Antwort nennen, welche Exporte betroffen waren.

### 1b. Löschen: Prompt und Historie verschwinden überall gleich

Anforderung:

1. Nach dem Löschen zählt der Prompt in **keiner** Auswertung mehr mit, für keinen Zeitraum:
   Dashboard (Kennzahlen, Visibility-Chart, Responses), Citations, Performance-Radar,
   Topic-Heatmap, Prompt Insights, Mira-Kontext, Exporte. Alle Ansichten zeigen danach dieselben,
   niedrigeren Zahlen.
2. Ein neu angelegter Prompt mit demselben Text beginnt bei null. Er darf nicht an der
   Eindeutigkeit `unique (team_id, prompt_text)` scheitern.
3. Nur inaktive Prompts sind löschbar (wie vorgeschlagen), nur `owner`/`admin`.
4. Alle Caches des Teams werden geleert (Prompt Insights, Dashboard, Citations, Radar, Bubble
   `rpc_cache`).

Weg: dein Weg (a), also endgültig löschen und die Team- und Topic-Rollups der betroffenen Tage
neu rechnen. Falls du (b) mit Filter in jeder Lesefunktion technisch für sicherer hältst, bitte
begründen. Das Ergebnis für den Nutzer muss dasselbe sein. Bitte sagen:

- wie lange die Neuberechnung bei 877c (102 Prompts, 30 Läufe pro Stunde) für einen gelöschten
  Prompt mit 90 Tagen Historie dauert;
- ob sie in der Transaktion läuft oder als Job. Wenn als Job: Wie erfährt die Oberfläche, dass
  die Zahlen wieder stimmen?

Die Oberfläche warnt vor dem Löschen. Wer die Historie behalten will, lässt den Prompt inaktiv.

---

## 2. Ergänzungen zum Vertrag

1. **`prompts_page_meta_v1` zusätzlich:**
   - `meta.role` des angemeldeten Nutzers (`owner`/`admin`/`member`). Die Oberfläche blendet den
     Löschknopf für `member` aus; geprüft wird trotzdem in der Datenbank.
   - `markets_all`: **alle** Märkte aus `app.markets` (`alpha2`, `name`, `flag_url`) für den
     Anlage-Dialog. `markets` mit Zählern bleibt, wie vorgeschlagen (nur Märkte mit Prompts).
2. **Rollenfehler:** `prompts_forbidden` bzw. `topics_forbidden`, PT403, `hint` = nötige Rolle
   (`owner|admin`). Gilt für `prompts_bulk_v1` mit `delete` und für `topic_delete_v1`.
3. **Emoji:** „≤ 8 Zeichen“ bitte als **Codepunkte** zählen und auf **≤ 16** setzen. Sonst fallen
   gültige Emoji mit Hautton und Verbindern durch. Zum Beispiel hat 👩🏽‍❤️‍💋‍👨🏻 zehn Codepunkte. Der
   Rest der Regel bleibt (keine Buchstaben, Ziffern, Leer- oder Steuerzeichen).
4. **`prompts_add_v1` Skip-Gründe** damit: `duplicate_in_batch`, `exists_active`,
   `exists_inactive`, `invalid_market`, `too_short`, `too_long`, `invalid_text` (nur leer nach
   Bereinigung).
5. **Namen:** `prompts_refresh_v1` (nicht `clear_prompt_insights_cache_v1`).
6. **Responses:** `cached_dashboard_responses_v1` unverändert; Aktualisieren der Unterseite über
   `clear_dashboard_cache_v1`. Einverstanden.
7. **Zu `topics_duplicate_name`:** Der `hint` mit der vorhandenen `tag_id` ist richtig so. Die
   Oberfläche wählt damit im Sammelpanel das bestehende Topic vor.

## 3. Was die Oberfläche selbst nachzieht (nur zur Kenntnis)

- Höchstens 5 Topics auch im Einzeleditor und im Anlage-Dialog.
- Topic-Name höchstens 60 Zeichen, auch beim Anlegen aus dem Suchfeld.
- Höchstens 10 eigene Gruppierungen, Name höchstens 60 Zeichen. Ausgeblendete werden nicht
  geschickt. `meta.dropped_tag_ids` räumt die Gruppierungen im Browser auf.
- `p_untagged` und `p_tag_ids` kommen nie zusammen: Im gruppierten Modus ist der Topic-Filter der
  Seite aus.
- Die neuen Feldnamen (`avg_sentiment`, `companies_mentioned_count`, `logo_url`, `tag_id`,
  `meta.counts`, `group_type`) übersetzt das Datenmodul der Seite.

## 4. Was ich nach dem Bau brauche

Wie bei Dashboard v1 eine Datei mit **echten, ungekürzten Antworten** (Team 877c, 30 Tage).
Schreibaufrufe bitte in zurückgerollten Transaktionen, Antwort jeweils mitschneiden.

- **Lesen:**
  - `cached_prompts_list_v1`: Vorgabe, Status `inactive`, Suche, Topic-Filter mit `and`,
    `p_untagged`, Markenfilter, `limit` 100;
  - `cached_prompts_groups_v1` mit `p_mode` `both`, `custom` und `topics`, dazu eine
    Gruppierung mit gelöschter Topic-ID;
  - `prompts_page_meta_v1`;
  - `cached_dashboard_responses_v1` mit Topic-Filter.
- **Schreiben:**
  - `prompts_add_v1` mit gemischtem Stapel: neu, Dublette im Stapel, bestehend aktiv,
    bestehend inaktiv, ungültiger Markt, zu kurz, zu lang, umgeschrieben, `-` am Anfang;
  - `prompt_topics_set_v1` mit 0 und 5 Topics;
  - `prompts_bulk_v1` mit allen vier Aktionen, je über `ids` und über `filter`;
  - `topic_save_v1` neu und bearbeiten;
  - `topic_delete_v1`;
  - `prompts_refresh_v1`.
- **Jeder Fehler einmal:**
  - `prompts_limit_reached` (Anlage und Aktivieren);
  - `prompts_selection_changed`;
  - `prompts_forbidden` (member löscht);
  - `topics_duplicate_name`;
  - `topics_limit_reached`;
  - `prompts_invalid_param` (z. B. `p_untagged` + `p_tag_ids`, Zeitraum > 400 Tage);
  - `prompts_not_found` (fremde ID);
  - `prompts_rate_limited`.
- **Löschen mit Historie (1b):** die Kennzahlen von `cached_dashboard_overview_v1` vor und nach dem
  Löschen eines Prompts mit Läufen im Zeitraum, im Rollback.
