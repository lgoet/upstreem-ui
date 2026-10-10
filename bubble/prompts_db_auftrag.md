# Auftrag an den Datenbank-Chat: Prompt Insights als Seiten-Komponente (Stand 10.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig:
der Datenbank-Chat hat das Frontend-Repo nicht.

**Diese Runde ist eine BESTANDSAUFNAHME mit FEHLERSUCHE, MISSBRAUCHSPRÜFUNG und VORSCHLAG. Du
änderst nichts.** Gebaut wird erst, wenn der Vertrag abgestimmt ist. Vorbilder sind die fertigen
Verträge Citations v1, Dashboard v1 und die Seiten-Verträge A–E (Performance, Opportunities,
Prompt Research, Mira, Teams): genau diese Bauart, diese Regeln, dieser Detailgrad.

---

## 0. Worum es geht

Die Ansicht **Prompt Insights** wird **eine** Komponente, die ihre Funktionen **selbst** aufruft:
PostgREST, `POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT, `Content-Profile: app`.
Bubble ist nicht mehr dazwischen. Heute sind es mehrere Bubble-Elemente (Kopf, Kalender, Filter,
Prompt-Tabelle, Response-Tabelle, Topic-Verwaltung, Anlage-Dialog) mit ihren Ereignissen und den
Workflows dahinter.

Aufbau der neuen Seite:

| Teil | Inhalt |
|---|---|
| Kopf | Titel „Prompt Insights“, drei Unterseiten, Knöpfe oben rechts je Unterseite (siehe unten) |
| Darunter | Kalender (Zeitraum) und Filter (Models, Markets, Topics) |
| Unterseite **All Prompts** | die Prompt-Tabelle (flach oder nach Topics gruppiert), Kennzahlkarten, Sammelaktionen |
| Unterseite **Responses** | die Response-Tabelle (ein Lauf je Zeile) |
| Unterseite **Topics** | Topic-Verwaltung (anlegen, bearbeiten, löschen) |

Knöpfe im Kopf:

| Unterseite | Knöpfe |
|---|---|
| All Prompts | „Add prompts“ (öffnet den Dialog, Abschnitt 2.4) und „Aktualisieren“ |
| Responses | „Aktualisieren“ |
| Topics | „Add topic“ |

Detail-Drawer (Prompt, Response) bleiben, wie sie sind. Die Seite öffnet sie nur
(`prompt` mit `prompt_id`, `response` mit `prompt_run_id`). Sie sind **nicht** Teil dieses
Auftrags.

Der Export-Dialog bleibt ebenfalls, wie er ist (eigenes Element, eigener Bubble-Workflow). Er
steht nur in Abschnitt 4.5 und 5, weil er Prompt-Texte in eine Datei schreibt.

---

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Wo `[NAME ERFRAGEN]` steht oder ein Name fehlt, fragst du nach. Bevor du
   über eine Funktion etwas sagst, holst du ihre Definition:
   `select pg_get_functiondef('app.NAME'::regproc);`
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag. Keine
   Schreibaufrufe gegen echte Teams, auch nicht „zum Testen“; wo du Verhalten beim Schreiben
   beschreibst, liest du es aus der Definition.
3. **Der Bestand läuft weiter.** Bubble ruft die alten Funktionen, bis die Seite umgestellt ist.
   Neues entsteht daneben als `_v1`.
4. `security definer` immer mit `set search_path`, `revoke` von `public`/`anon`, Zugang über
   `app.require_team_access(p_team)`. Der Nutzer kommt immer aus dem JWT.
5. **Gleiche Zahl, eine Quelle.** Visibility, Rang und Sentiment eines Prompts müssen nach
   denselben Regeln entstehen wie im Dashboard v1 (Berliner Kalendertag, Gewichtung über Runs,
   Sentiment höchstens 30 Tage). Was es in einem `_v1`-Vertrag schon gibt, wird
   wiederverwendet, nicht neu gerechnet.
6. **Form wie Dashboard v1:**
   - reines `jsonb` mit `meta` und `rows` bzw. benannten Abschnitten;
   - stabile Fehler-`message` (`prompts_invalid_param`, `prompts_rate_limited` mit `PT429`,
     `prompts_not_found`, `prompts_limit_reached` mit `PT409`, `topics_*` entsprechend);
   - leer heißt `[]` mit `total_count: 0`, nie ein Fehler;
   - Logos und Favicons absolut;
   - Gesamtzahl für das Blättern einmal in `meta`, nicht auf jeder Zeile.
7. **Schreibende Funktionen** prüfen alles selbst (Team, Besitz jeder ID, Grenzen, Planlimit),
   geben die geänderten Zeilen bzw. Zähler zurück, schreiben ihren Protokolleintrag selbst und
   leeren die betroffenen Caches selbst. Kein `exception when others` (Fehler fangen und
   schlucken). Das hat bei `manage_suggested_prompts_v1` das XX000-Risiko gebracht.
8. **Die Oberfläche ist kein Schutz.** Jede Grenze, die heute nur im Browser steht (Abschnitt 4),
   gilt ab jetzt in der Datenbank. Der Browser kann jede Nutzlast frei bauen.

---

## 2. Was die Seite zeigt und was man dort tun kann

Gemeinsame Filter aller Lese-Funktionen (aus Kalender und Filterleiste):
Zeitraum `date_from`/`date_to`, Models (Liste), Markets (Liste), Topics (Liste plus Modus `or`/`and`).

### 2.1 All Prompts: die Tabelle

**Lesen, flach.** Heute `cached_prompt_insights_alltime_v18` (laut Vorlage). Die Oberfläche
schickt bzw. braucht:

| Bedienung | Werte heute | Parameter heute (laut Vorlage) |
|---|---|---|
| Suche | Text, dazu `query_folded` (ohne Akzente) und `query_de` (deutsche Erweiterung) | `p_search` |
| Sortierung | `name_asc/desc`, `visibility_desc/asc`, `rank_asc/desc`, `sentiment_desc/asc`, `created_at_desc/asc`; Vorgabe `visibility_desc` | `[NAME ERFRAGEN]` |
| Seite | 15/25/50/100 je Seite, `limit`/`offset` | `[NAME ERFRAGEN]` |
| Status | Reiter **Active** / **Inactive** | `p_only_active` |
| eigene Marke erwähnt | `yes` / `no` / aus | vermutlich `p_mentioned`, bitte bestätigen |
| Erwähnte Marken | Liste von Marken-IDs | vermutlich `p_company_ids`, bitte bestätigen |
| Topic-Gruppe | Topic-IDs, Modus `and`, „ohne Topic“ | `p_tag_ids`, `p_tagmode`, `p_untagged` |
| Kalender, Models, Markets, Topics | siehe oben | `p_date_from`, `p_date_to`, `p_models`, `p_markets`, `p_tag_ids`, `p_tagmode` |

Felder, die die Tabelle **heute liest** (aus dem Code):

- **Zeile:** `prompt_id`, `prompt_text`, `visibility_pct`, `avg_rank`, `avg_sentiment_30d`,
  `top_mentions[]` (`name`, `favicon_url` bzw. `favicon`), `companies_preview_totalcount`,
  `tags[]` (`id`/`tag_id`, `name`, `emoji`, `hex_light`, `hex_dark`), `market` (alpha-2),
  `created_at`.
- **Kopf:** Gesamtzahl aktiv, Gesamtzahl inaktiv, Zahl der Prompts **ohne Topic**.

**Lesen, gruppiert.** Heute `cached_prompt_topics_grouped_v1` (laut Vorlage) mit denselben
Filtern plus `p_groups` und `p_mode`:

- `p_mode`: `both` (Topic-Gruppen und eigene Gruppierungen), `custom` (nur eigene), `topics`
  (nur Topic-Gruppen).
- `p_groups`: eigene Gruppierungen des Nutzers als JSON, `[{"key":"SUV & Hybrid","tag_ids":["t1","t3"]}]`.
  Sie liegen heute **nur im Browser** (localStorage, je Team), höchstens 3 Topics je Gruppierung.
  Eine Gruppe enthält die Prompts mit **allen** ihren Topics (`and`).
- Je Gruppe liest die Oberfläche: `group_key`, `tag_id`, `tag_name`, `tag_emoji`, `tag_hex_light`,
  `tag_hex_dark`, `is_custom`, `is_untagged`, `prompts_count`, `prompts_count_inactive`,
  `visibility_pct`, `avg_rank`, `avg_sentiment`.
- Aufgeklappt lädt eine Gruppe ihre Prompts über die flache Funktion (Topic-IDs der Gruppe,
  `and`, oder `p_untagged`), mit eigenem Blättern (10/25/50).
- Heute werden die Gruppen bei Suche und Markenfilter **nicht** neu geladen (bewusster
  Kompromiss); ihre Zahlen zeigen den Stand des letzten Ladens. Neu sollen sie immer mit
  denselben Filtern laden wie die Tabelle. Bitte sagen, ob das teuer wird.

**Schreiben** (heute Bubble-Workflows; die Aufrufe dahinter stehen in Abschnitt 3):

| Aktion | Nutzlast heute | Hinweise |
|---|---|---|
| Topics **eines** Prompts ersetzen | `prompt_id`, `tag_ids[]` (vollständige neue Menge, darf leer sein) | heute **ohne** Obergrenze. In Bubble ist dafür **kein Workflow** zu finden: die Änderung wird heute vermutlich nirgends gespeichert. Es braucht eine neue Funktion |
| Sammelaktion: Topics **hinzufügen** | Auswahl (siehe unten) + `tag_ids` (höchstens 5, nur im Browser geprüft) | nur hinzufügen, nie entfernen |
| Sammelaktion: aktiv / inaktiv setzen | Auswahl + Ziel `active`/`inactive` | Aktivieren verbraucht Kontingent: wird das Planlimit geprüft? |
| Sammelaktion: löschen | Auswahl | nur im Reiter Inactive angeboten. Endgültig? Was passiert mit Runs, Responses und Kennzahlen? |
| Neues Topic aus dem Sammelpanel | `new_topic_name`, `new_topic_emoji`, `new_topic_hex_light`, `new_topic_hex_dark` (die Auswahl reist mit, wird aber nicht benutzt) | legt **nur** das Topic an (`create_tag`). Die Oberfläche wählt es danach im Panel vor; zugewiesen wird erst mit „Apply“ über die Sammelaktion |

**Die Auswahl** hat heute drei Formen:

| Modus | Bedeutung | Felder |
|---|---|---|
| `ids` | einzeln angehakt | `ids` |
| `filter` | „Alle N auswählen“ in der flachen Tabelle | Suche, Markenfilter, Status, Sortierung, `excluded_ids`, `count` |
| `filter_group` | „Alle N auswählen“ in einer aufgeklappten Gruppe | `group_key`, `tag_ids`, `tagmode`, `is_custom`, `untagged`, `excluded_ids`, `count` |

**Bekannte Lücke dabei, bitte im Vorschlag schließen:** Im Modus `filter` fehlen heute
Zeitraum, Models, Markets, Topics und erwähnte Marken, im Modus `filter_group` zusätzlich Suche
und Markenfilter. Eine Sammelaktion kann also mehr Prompts treffen, als der Nutzer sieht. Neu
schickt die Seite für `filter` und `filter_group` **genau dieselben Filterparameter wie die
Lese-Funktion** plus `excluded_ids`. Die Datenbank rechnet die Zielmenge selbst, nach derselben
Logik wie die Liste.

So läuft es heute in Bubble: Modus `ids` geht direkt an die Schreibfunktion; Modus `filter` ruft
erst `resolve_prompt_ids` und gibt deren IDs an die Schreibfunktion. Für `filter_group` ist in
den Workflows **keine** Bedingung zu sehen: eine Sammelaktion nach „Alle N auswählen“ in einer
Gruppe tut heute vermutlich nichts.

### 2.2 Responses: die Tabelle

Ein Lauf je Zeile. Die Bedienung ist **identisch** mit der Responses-Liste im Dashboard, die
schon direkt `cached_dashboard_responses_v1` aufruft: Suche, Sortierung `run_at_desc/asc`,
`rank_asc/desc`, `sentiment_desc/asc`, eigene Marke erwähnt (`yes`/`no`/`all`), erwähnte Marken
(`p_company_ids`), Rang 1–20+ und Sentiment 0–100 als Bereich, Blättern (Tabelle 15/25/50/100,
Karten 6/12/24/48), dazu Zeitraum, Models, Markets, Topics.

Felder, die die Tabelle liest: `prompt_run_id`, `prompt_text`, `has_user_brand`,
`user_sentiment`, `user_rank`, `companies_preview[]` (`name`, `favicon_url`, `brand_name_raw`),
`companies_preview_totalcount`, `sources_preview[]` (`title`, `favicon`), `sources_totalcount`,
`model`, `run_at`, `response_preview` (nur Kartenansicht), `meta.total_count`.

**Vorschlag:** `cached_dashboard_responses_v1` unverändert wiederverwenden. Bitte prüfen:

- Welche Funktion ruft Bubble heute auf der Responses-Unterseite? `[NAME ERFRAGEN, falls aus der
  Bestandsaufnahme nicht eindeutig]`
- Liefert sie für dieselben Filter dieselben Zeilen wie `cached_dashboard_responses_v1`?
- Ist `response_preview` Modelltext? Dann gilt die Backtick-Regel (Abschnitt 4.4), auch wenn die
  neue Seite nicht mehr über Bubble läuft. Dieselben Daten erreichen über andere Ansichten noch
  Bubble.

### 2.3 Topics: die Verwaltung

**Lesen:** je Topic `id`, `name`, `emoji`, `hex_light`, `hex_dark`, `prompt_count`, `created_at`
(ISO). Suche und Sortierung (Nutzung, neueste, Name) macht die Oberfläche selbst; die Liste kommt
in **einem** Aufruf. Gibt es dafür schon eine Funktion (`get_tags_v2`?), die mit Nutzer-JWT
aufrufbar ist? Zählt `prompt_count` nur aktive Prompts?

**Schreiben** (heute drei Bubble-Ereignisse):

| Aktion | Nutzlast heute |
|---|---|
| anlegen | `name` (Oberfläche: 1–60 Zeichen), `emoji` (leer oder ein Emoji), `hex_light`, `hex_dark` (heute immer gleich) |
| bearbeiten | dasselbe plus `id`; vollständiges Ersetzen, kein Teil-Update |
| löschen | `id`; endgültig. Was passiert mit den Zuordnungen und den eigenen Gruppierungen, die das Topic enthalten? |

### 2.4 Dialog „Add prompts“

Ein Aufruf je Speichern:

```json
{"count": 2,
 "prompt_texts": ["Wer bietet \"KI-Schulungen\" an, und wo?", "Which tools help with SEO?"],
 "markets": ["de", ""],
 "tag_ids": "t1,t2",
 "input_method": "manual",
 "source": "user_generated"}
```

- `prompt_texts` und `markets` sind gleich lang und laufen parallel. Ein leerer Markt kommt vor,
  wenn weder die Zeile noch der Dialog einen Markt hat. Was die Datenbank heute daraus macht,
  bitte nachsehen.
- `tag_ids` gilt für den ganzen Stapel.
- `input_method`: `manual` oder `csv`. `source`: immer `user_generated`.
- Heute nur im Browser geprüft: höchstens 100 je Stapel, Dubletten nur **innerhalb** des Stapels.
  Es gibt keine Längengrenze, keine Prüfung gegen bestehende Prompts und keine Prüfung des
  Planlimits.
- Ein CSV-Import kann Zeilenumbrüche innerhalb eines Prompts liefern.

Bitte klären: Was passiert beim Anlegen heute alles? Zum Beispiel ein Schedule, ein sofortiger
erster Lauf (n8n?), das Leeren des Insights-Caches, der Topic-Zähler. Die Anlage in
`prompt_research_decide_v1` (Planlimit, Schedule, höchstens 5 Tags, Cache leeren) ist das
Vorbild. Beide Wege sollen **eine** gemeinsame interne Anlage-Funktion benutzen.

### 2.5 Kopf, Ablagen, Aktualisieren

- **Kennzahlkarten** über der Tabelle: Topics (aus der Topic-Liste mit `prompt_count`), Markets
  (`alpha2`, `name`, `prompt_count`), Kontingent (`used`, `total`, `plan`). Nach jedem Anlegen,
  Aktivieren oder Löschen braucht die Oberfläche den neuen Stand des Kontingents. Bitte in der
  Antwort jeder schreibenden Funktion mitgeben (wie `prompt_research_decide_v1`:
  `prompts_active`, `prompts_limit`, `prompts_remaining`).
- **Aktualisieren** auf All Prompts bzw. Responses: Regel der App ist, dass jeder
  Aktualisieren-Knopf den DB-Cache seines Bereichs leert und frisch lädt. Heute leert das
  Aktualisieren **keinen** Cache; `clear_prompt_insights_cache` läuft nur nach Schreibaktionen.
  Neu: Aktualisieren auf All Prompts leert den Prompt-Insights-Cache (`_v1`-Fassung). Für
  Responses: reicht `clear_dashboard_cache_v1`, oder leert das zu viel?
- **Ablagen der App:** Topics und Markets kommen heute beim Seitenaufbau von Bubble
  (`setUpstreemTopics`, Markets-Store). Nach Topic- und Prompt-Änderungen sollen beide neu
  geladen werden. Gibt es Lesefunktionen dafür (`get_tags_v2`, `get_markets_v2`), die die Seite
  direkt aufrufen darf?

---

## 3. Bestandsaufnahme (bitte die Ergebnisse schicken)

```sql
-- A) Funktionen dieser Bereiche: Argumente, Rückgabe, Sicherheit, Team-Prüfung
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team,
       position('auth.uid()' in pg_get_functiondef(p.oid)) > 0           as nutzt_uid,
       position('exception' in lower(pg_get_functiondef(p.oid))) > 0     as faengt_fehler
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.prokind = 'f'
  and p.proname ~* '(prompt|insight|response|run|mention|tag|topic|group|market|quota|limit|bulk)'
order by p.proname;

-- B) Rechte darauf
select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'app'
  and p.proname ~* '(prompt|insight|response|run|mention|tag|topic|group|market|quota|limit|bulk)'
order by p.proname, r.rolname;

-- C) Tabellen dieser Bereiche mit Spalten
select table_schema, table_name,
       string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema in ('app','public')
  and table_name ~* '(prompt|insight|tag|topic|market|schedule|run|response|quota|plan)'
group by table_schema, table_name order by 1, 2;

-- D) Fremdschlüssel und ON DELETE-Verhalten rund um Prompts und Tags
select c.conrelid::regclass  as tabelle,
       c.confrelid::regclass as zeigt_auf,
       pg_get_constraintdef(c.oid) as definition,
       case c.confdeltype when 'a' then 'no action' when 'r' then 'restrict' when 'c' then 'cascade'
                          when 'n' then 'set null' when 'd' then 'set default' end as on_delete
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where c.contype = 'f' and n.nspname in ('app','public')
  and (c.conrelid::regclass::text ~* '(prompt|tag)' or c.confrelid::regclass::text ~* '(prompt|tag)')
order by 1, 2;

-- E) Trigger auf diesen Tabellen (Anlage, Schedule, Cache, n8n)
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('app','public')
  and event_object_table ~* '(prompt|tag|topic|schedule)'
order by 1, 2;

-- F) RLS: welche dieser Tabellen haben Policies, und welche?
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('app','public') and tablename ~* '(prompt|tag|topic|schedule)'
order by 1, 2, 3;

-- G) Datenlage (nur Zähler, Hauptteam und gesamt)
--    Prompts aktiv/inaktiv je Team (max, p95), Topics je Team (max), Topics je Prompt (max),
--    Länge der Prompt-Texte (max, p99), Prompts mit Zeilenumbruch, Backtick, '${' oder Backslash,
--    Topic-Namen mit Backtick, Anführungszeichen oder Backslash, Dubletten (gleicher Text +
--    gleicher Markt im selben Team), Topics ohne Prompt, Zuordnungen auf gelöschte Topics.
```

**Die Aufrufe der heutigen Seite** (Namen der Aufrufe in Bubble; welche Funktion mit welcher
Fassung dahinter steht, bitte du selbst ermitteln):

| Aufruf in Bubble | Wofür (gesichert = im Workflow gesehen) |
|---|---|
| `get_prompt_insights_alltime` | flache Tabelle (gesichert) |
| `cached_prompt_topics_grouped` | Gruppen (gesichert) |
| `get_tags` | Topic-Liste (gesichert) |
| `create_prompt_with_tags` | „Add prompts“ (gesichert) |
| `clear_prompt_insights_cache` | nach jeder Schreibaktion außer „Topic anlegen“ (gesichert). **Nicht** beim Aktualisieren |
| `get_team_plan_quota` | Kontingent: beim Seitenaufbau, nach Filter- und Zeitraumwechsel und nach Schreibaktionen (gesichert) |
| `create_tag` | Topic anlegen, aus der Verwaltung und aus dem Sammelpanel (gesichert). Antwortet mit `created` (yes/no): wann ist es `no`? |
| `update_tag`, `delete_tag` | Topic bearbeiten, löschen (gesichert) |
| `assign_tags_bulk` | Sammelaktion Topics zuweisen (gesichert) |
| `set_prompts_active`, `set_prompts_inactive`, `delete_prompts` | Sammelaktionen (gesichert) |
| `resolve_prompt_ids` | „Alle N auswählen“ → IDs, vor jeder Sammelaktion im Modus `filter` (gesichert). Bitte genau beschreiben, welche Filter sie kennt |

Nach jeder Schreibaktion außer dem Anlegen eines Topics ruft Bubble `clear_prompt_insights_cache`
und lädt Tabelle und Kontingent neu, nach Topic-Änderungen und Löschen auch die Topics.

Die Responses-Liste steht **nicht** in dieser Liste; sie wird in einem eigenen Bubble-Element
geladen. Bitte die Funktion finden, die heute Responses einer Seite liefert (Vorgänger von
`cached_dashboard_responses_v1`, im Dashboard-Vertrag „wie v21“), und prüfen, ob
`cached_dashboard_responses_v1` für dieselben Filter dieselben Zeilen liefert.

Für jede dieser Funktionen und für die Responses-Liste:

1. die Definition;
2. ein echtes Beispiel (Hauptteam, letzte 30 Tage): die ersten 3 Zeilen und die Laufzeit, kalt
   und warm, dazu 90 Tage für die beiden Lese-Funktionen;
3. ob sie `p_team` gegen den angemeldeten Nutzer prüft und ob **jede übergebene ID** (Prompt,
   Tag, Marke) auf Zugehörigkeit zum Team geprüft wird;
4. was sie rechnet, das ein bestehender `_v1`-Vertrag schon rechnet (Visibility, Rang, Sentiment
   wie Dashboard v1?).

---

## 4. Fehlersuche und Missbrauchsprüfung (das volle Paket)

Bitte zu jedem Punkt: **Befund** (mit Abfrage oder Definitionsstelle), **Schwere**, **Vorschlag**.

### 4.1 Rechenfehler und Widersprüche

1. Stimmen die Zahlen einer Gruppe (`prompts_count`, `visibility_pct`, `avg_rank`,
   `avg_sentiment`) mit der Summe bzw. dem Mittel ihrer Prompts aus der flachen Funktion überein?
2. Stimmen Visibility, Rang und Sentiment eines Prompts mit dem Dashboard v1 für denselben
   Zeitraum und dieselben Filter? Was bedeuten `alltime` im Namen und `avg_sentiment_30d`, wenn ein
   Zeitraum übergeben wird?
3. Erscheint ein Prompt ohne Run im Zeitraum (mit `null`-Kennzahlen) oder fehlt er?
4. Zählen `total_count`, `total_count_inactive` und „ohne Topic“ unter denselben Filtern wie die
   Zeilen?
5. Sortierung mit `null` (Prompt ohne Rang): wo landen die Zeilen, und ist die Reihenfolge bei
   Gleichstand stabil (zweiter Schlüssel)? Sonst springen Zeilen beim Blättern.
6. Topics-Filter `or`/`and` und `p_untagged` zusammen: was passiert?
7. `prompt_count` eines Topics: aktiv, inaktiv oder beide? Gleich zwischen Topic-Liste, Gruppen
   und Kennzahlkarte?
8. Zeitzone: alle Tagesgrenzen Europe/Berlin?

### 4.2 Zugriff

1. Jede Funktion: Zugang nur über `require_team_access`, nichts mit `anon` ausführbar.
2. Jede Schreibfunktion: Prompt-, Tag- und Marken-IDs aus einem **fremden** Team dürfen weder
   gelesen noch verändert noch zugewiesen werden, auch nicht gemischt mit eigenen IDs in einer
   Liste. Heute schickt der Browser Team und IDs frei.
3. Rollen im Team: darf jedes Mitglied löschen, Planlimit-relevant aktivieren, Topics löschen?
   Gibt es heute eine Rollenprüfung?
4. RLS auf den Tabellen: reicht sie allein, falls eine Funktion `security invoker` ist?

### 4.3 Grenzen und Planlimit (alles serverseitig)

| Was | Heute (nur Browser) | Bitte festlegen |
|---|---|---|
| Prompts je Anlage | 100 | 1–100 |
| Länge eines Prompts | keine | Vorschlag 3–500 Zeichen, nach Trimmen |
| Dubletten | nur im Stapel | auch gegen Bestand (gleicher Text normalisiert + gleicher Markt) |
| Planlimit | gar nicht geprüft (nur angezeigt) | bei Anlage **und** beim Aktivieren, atomar (zwei gleichzeitige Aufrufe dürfen das Limit nicht gemeinsam überschreiten) |
| Topics je Prompt | 5 im Sammeleditor, **keine** Grenze im Einzeleditor | eine Zahl für alle Wege (Vorschlag 5, wie Prompt Research) |
| Topics je Team | keine | Vorschlag nennen |
| Topic-Name | 60 Zeichen (Dialog), **keine** Grenze beim Anlegen aus dem Suchfeld | 1–60, eindeutig je Team (ohne Groß/Klein)? |
| Topic-Farbe | frei | genau `^#[0-9a-fA-F]{6}$`. Der Wert landet heute ungeprüft in einem `style`-Attribut |
| Emoji | frei | leer oder ein Graphem, Länge begrenzt |
| Eigene Gruppierungen in `p_groups` | 3 Topics je Gruppe | höchstens Anzahl, `key` 1–60, nur Tags des Teams |
| Markt | beliebige zwei Buchstaben aus der CSV | nur Märkte aus der Markttabelle |
| Sammelaktion im Modus `filter` | unbegrenzt | Obergrenze? Und `p_expected_count`: weicht die tatsächliche Zielmenge davon ab, **nichts** tun und einen Fehler melden (der Nutzer hat eine Zahl bestätigt) |
| Löschen | nur im Reiter Inactive angeboten | serverseitig nur inaktive Prompts löschbar |

### 4.4 Text, der Bubble noch erreicht

Die neue Seite liest direkt. Dieselben Prompt-Texte, Topic-Namen und Responses laufen aber
weiterhin durch Bubble-Schritte anderer Ansichten (Drawer, Run-JS mit Backticks). Ein Backtick,
ein `${` oder ein Backslash am Ende tötet dort den ganzen Schritt.

- Bitte zählen, wie viele bestehende Prompts und Topics solche Zeichen tragen (Abfrage G).
- Bitte vorschlagen: bei der Anlage abweisen (`prompts_invalid_text`) oder umschreiben. Die
  Entscheidung trifft der Nutzer.
- Steuerzeichen, Nullbreiten-Zeichen und Zeilenumbrüche in Prompt-Texten: Vorschlag?

### 4.5 Spam, Last, Wiederholung

1. **Ratenlimits** je Nutzer und Funktion, wie Dashboard v1 (Lesen 60 pro Minute, Aktualisieren
   10 pro Minute). Für Anlage und Sammelaktionen bitte eigene Zahlen vorschlagen.
2. **Doppelklick und Wiederholung:** Wird dieselbe Anlage zweimal geschickt (Netzfehler,
   Doppelklick), dürfen keine doppelten Prompts entstehen. Dubletten-Prüfung oder ein
   `p_request_id`?
3. **Teure Anfragen:** 180 Tage, alle Gruppen, Suche mit einem Zeichen, `limit` 100: Laufzeit?
   Schutz vor bewusst teuren Kombinationen?
4. **Endlose Topic-Anlage** über das Suchfeld: Grenze je Team und Zeit.
5. **CSV-Export (nur zur Kenntnis, gehört zum Export-Workflow):** Prompt-Texte, die mit `=`, `+`, `-` oder `@`
   beginnen, werden in Tabellenprogrammen als Formel ausgeführt. Wird beim Export maskiert?

### 4.6 Konsistenz beim Schreiben

1. Prompt löschen: endgültig oder weich? Was hängt daran (Runs, Responses, Recommendations,
   Opportunities, Kennzahlen im Dashboard)? Ändern sich historische Zahlen anderer Ansichten?
2. Topic löschen: Zuordnungen weg? Prompts ohne Topic? Was passiert mit eigenen Gruppierungen
   (liegen im Browser)?
3. Welche Caches muss jede Schreibfunktion leeren (Prompt-Insights, Dashboard, Citations,
   Performance-Radar, Topic-Heatmap)?

---

## 5. Was nicht in diesen Auftrag gehört (zur Abgrenzung)

- **Export-Dialog:** eigenes Element, schickt heute Typ, Zeitraum und ein Export-Token an einen
  Bubble-Workflow. Bleibt. Punkt 4.5.5 ist nur der Hinweis.
- **Detail-Drawer** Prompt und Response: bleiben in Bubble.
- **Prompt Research:** eigener Vertrag (C). Nur die gemeinsame Anlage (2.4) berührt
  ihn.
- **Eigene Gruppierungen** bleiben vorerst im Browser. Falls du Gründe siehst, sie in die
  Datenbank zu legen (geräteübergreifend, im Team geteilt), bitte als Option mit Aufwand nennen;
  die Entscheidung trifft der Nutzer.

---

## 6. Dein Vorschlag (noch nicht bauen)

Schlag einen Vertrag in der Form der Seiten-Verträge vor. Zum Prüfen, nicht als Vorgabe:

| Funktion | Zweck |
|---|---|
| `cached_prompts_list_v1` | flache Tabelle und aufgeklappte Gruppe (gemeinsame Filter + Suche, Sortierung, Seite, Status, Marken, Topic-Gruppe) |
| `cached_prompts_groups_v1` | Gruppenköpfe mit Kennzahlen (`p_mode`, `p_groups`, dieselben Filter) |
| `prompts_add_v1` | Anlage (2.4), gemeinsame Anlage mit Prompt Research |
| `prompt_topics_set_v1` | Topics eines Prompts ersetzen |
| `prompts_bulk_v1` | Sammelaktionen `add_topics`, `set_active`, `set_inactive`, `delete`; Ziel `ids` oder `filter` (dieselben Filter wie die Liste) + `excluded_ids` + `p_expected_count` |
| `topics_list_v1` (oder bestehend) | Topic-Liste |
| `topic_save_v1`, `topic_delete_v1` | anlegen/bearbeiten, löschen |
| `cached_dashboard_responses_v1` (besteht) | Responses |
| `clear_prompt_insights_cache_v1` | Aktualisieren |

Dazu:

1. eine **gemeinsame Filtertabelle** (Parameter, Typ, Vorgabe, was „leer“ bedeutet);
2. zu jeder Funktion Parameter, Antwortform und ein **echtes Beispiel**;
3. die **Grenzen aus 4.3** als Tabelle mit Fehler-`message`;
4. die **Ratenlimits**;
5. die **Befunde aus Abschnitt 4**, sortiert nach Schwere;
6. **offene Fragen**, die nur der Nutzer beantworten kann (Rollen, Umgang mit Sonderzeichen,
   Topic-Grenzen, Löschen endgültig oder weich).

Ich prüfe den Vorschlag gegen die Oberfläche und gebe ihn dir abgestimmt zurück. Erst dann baust du.
