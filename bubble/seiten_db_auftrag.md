# Auftrag an den Datenbank-Chat: fünf Ansichten als Seiten-Komponenten (Stand 09.10.2026)

Diesen ganzen Text als erste Nachricht in den Datenbank-Chat geben. Er ist in sich vollständig.

**Diese Runde ist eine BESTANDSAUFNAHME mit VORSCHLAG. Du änderst nichts.** Gebaut wird erst,
wenn die Verträge abgestimmt sind. Vorbilder sind die fertigen Verträge Citations v1 und
Dashboard v1 (`cached_citations_*_v1`, `cached_dashboard_*_v1`, `dashboard_chats_v1`,
`dashboard_opportunities_v1`): genau diese Bauart, diese Regeln, dieser Detailgrad.

Es geht um fünf Ansichten:

- **A. Performance**: der Performance Radar und sein Detail
- **B. Opportunities**: das Brett und das Seitenpanel
- **C. Prompt Research**
- **D. Mira**: Ask Mira, der Chat
- **E. Team-Organisation**: Mitglieder, Einladungen, Protokoll, Teams-Liste

Jede Ansicht wird **eine** Komponente, die ihre Funktionen **selbst** aufruft: PostgREST,
`POST /rest/v1/rpc/<funktion>`, Schema `app`, Nutzer-JWT, `Content-Profile: app`. Bubble ist nicht
mehr dazwischen.

---

## 1. Regeln, ohne Ausnahme

1. **Nichts raten.** Wo `[NAME ERFRAGEN]` steht oder ein Name fehlt, fragst du nach. Bevor du über
   eine Funktion etwas sagst, holst du ihre Definition:
   `select pg_get_functiondef('app.NAME'::regproc);`
2. **In dieser Runde keine Änderung.** Nur Leseabfragen, Ergebnisse und ein Vorschlag.
3. **Der Bestand läuft weiter.** Bubble ruft die alten Funktionen, bis jede Ansicht umgestellt
   ist. Neues entsteht daneben als `_v1`.
4. `security definer` immer mit `set search_path`, `revoke` von `public`/`anon`, Zugang über
   `app.require_team_access(p_team)`. Der Nutzer kommt immer aus dem JWT.
5. **Gleiche Zahl, eine Quelle.** Was es in einem `_v1`-Vertrag schon gibt, wird
   wiederverwendet, nicht neu gerechnet.
6. **Form wie Dashboard v1:**
   - reines `jsonb` mit `meta` und `rows` bzw. benannten Abschnitten;
   - stabile Fehler-`message` (`<bereich>_invalid_param`, `_rate_limited` mit `PT429`,
     `_not_found`, `_forbidden`);
   - leer heißt `[]` mit `total_count: 0`, nie ein Fehler;
   - Logos und Favicons absolut;
   - kein Backtick, kein `${` und kein Backslash in Text aus einem Sprachmodell.
7. **Schreibende Funktionen** geben die geänderte Zeile zurück (oder `{ok:true, id}`), schreiben
   den Protokolleintrag selbst und leeren die betroffenen Caches selbst.
8. **Lange Läufe** (LLM, E-Mail, PDF) sind keine RPC. Bitte schlage für jeden einen Weg vor: eine
   Start-Funktion, die einen Auftrag anlegt (`job_id` zurück), dazu den Stand über eine
   Lese-Funktion oder über Realtime. Wer den Auftrag ausführt (n8n, Edge Function), sagst du.

---

## 2. Die fünf Ansichten: was die Oberfläche heute liest und auslöst

### A. Performance

Nur Lesen, keine Schreibaktion. Heute liefert Bubble vier unbenannte RPCs:

| Teil | Felder, die die Oberfläche liest |
|---|---|
| **Radar** (Topic × Marke) | `cells[]`: `topic_id`, `topic_name`, `topic_emoji`, `topic_hex_light`, `topic_hex_dark`, `topic_position`, `topic_share_pct`, `company_id`, `company_name`, `logo_url`, `role`, `company_position`, `visibility_pct`, `sentiment`, `avg_rank`, `mentions`, `mentions_prev`, `visibility_delta_pct`, `sentiment_delta`, `avg_rank_delta`, `heat_value_visibility`, `heat_value_rank`, `heat_value_sentiment` (je 0..1). Dazu `ranges{visibility_min, visibility_max, sentiment_min, sentiment_max, rank_min, rank_max}`, `selection{topic_limit, company_limit}` (Vorgabe 12/12), `selected_topics[]`, `selected_companies[]`, `available_topics[]`, `available_companies[]`. |
| **Detail: Variationen** | Je Prompt-Variante `name`, `mentioned_count`, `share_of_voice_pct`, `mentions_total`. Die Vorlage nennt `total_count`, der Code rechnet mit `mentions_total`; bitte klären. |
| **Detail: Kurve** | `{scope: topic\|global, company_id, series:[{day, value}], granularity}` |
| **Detail: URLs** | Dieselbe Form wie `cached_citations_urls_v1`. Prüfen, ob das genau diese Funktion mit Filter `p_tag_ids` + Marke ist. |

- **Bedienung:** Metrik (Visibility, Rank, Sentiment) wechselt nur lokal.
- **Auswahl:** Marken und Topics (`company_ids`, `topic_ids`) bestimmen die Daten neu.
- **Zellklick:** Topic + Marke laden das Detail.
- **Zeitraum:** Kalender und Filter gibt es heute nicht. Welchen Zeitraum und welche Vorperiode
  rechnet der Radar? Er soll dieselben Regeln wie Dashboard v1 bekommen: Berliner Kalendertag,
  Vorperiode `greatest(least(Tage/2, 30), 1)`, Sentiment höchstens 30 Tage.

### B. Opportunities

**Lesen:** `dashboard_opportunities_v1(p_team)` ist schon da; das Brett bekommt genau diese Zeilen.

**Schreiben** (heute Bubble-Workflows, kein RPC-Name bekannt):

| Aktion | Nutzlast heute | Brauche |
|---|---|---|
| Status ändern (Drag & Drop, Seitenpanel, Ignorieren) | `opportunity_id`, `status` (Created, In Progress, Done, Ignored), `previous_status` | `opportunity_set_status_v1(p_team, p_id, p_status)` |
| Alle einer Spalte verschieben | `opportunity_ids[]`, Ziel-Status | `opportunity_set_status_many_v1(p_team, p_ids, p_status)` |
| Opportunity aus Mira anlegen | `lead_url`, `title`, `reason`, `recommendation_type` → `{status: Created\|AlreadyExists, recommendation}` | `[NAME ERFRAGEN]`, heute ruft Bubble einen RPC |
| „Look for new Opportunities“ | Start eines Generierungs-Laufs (die Oberfläche wartet bis 3 min) | **langer Lauf**, siehe Regel 8 |

Die Tabelle heißt vermutlich `recommendations` (die Oberfläche schickt `recommendation_id` als
Alias). Bitte bestätigen. Nach jeder Änderung müssen `dashboard_opportunities_v1` und
`get_power_dashboard_v1` den neuen Stand zeigen.

### C. Prompt Research

Kein einziger RPC-Name im Repo. Heute fünf Bubble-Ereignisse:

| Aktion | Nutzlast | Art |
|---|---|---|
| Recherche starten | `keywords` (Kommaliste, höchstens 300 Zeichen), `market` (alpha2/alpha3/name), `business_model` (b2c\|b2b\|hybrid), `persona` (\|student\|entrepreneur\|smb_owner\|parent_family\|tech_enthusiast) | **langer Lauf** (LLM: Varianten, Volumen, Tags) |
| Frühere Recherchen | Liste je Team: `job_id`, `keywords`, `market`, `market_name`, `business_model`, `persona`, `prompt_count`, `created_at`/`finished_at` | Lesen |
| Ergebnis eines Laufs | `rows[]`: `suggested_prompt_id`, `row_index`, `prompt_text`, `market`, `estimated_volume` (0–100), `tags[]{tag_id, name, emoji, hex_light, hex_dark}` + Meta des Laufs | Lesen |
| Recherche löschen | `job_id` | Schreiben |
| Vorschlag übernehmen (einzeln / alle) | `suggested_prompt_ids[]`, `accept_with_tags` | Schreiben: legt **Prompts** an, auf Wunsch mit Topic-Verknüpfung. Gibt es Kontingent-Prüfungen (Prompt-Limit des Plans)? |
| Vorschlag verwerfen (einzeln / alle) | `suggested_prompt_ids[]` | Schreiben |
| Märkte für die Auswahl | `alpha2`, `alpha3`, `name`, `flag_url`, `prompt_count` | Lesen; gibt es das schon (Markets-Store)? |

### D. Mira

Größter Teil. Antworten kommen heute über Supabase Realtime, Kanal `mira_user_<user_id>`
(n8n veröffentlicht): `mira_turn_started`, `mira_message_success`, `mira_message_error`,
`mira_title_updated`, `mira_user_transcript` und Tool-Ereignisse. Bekannt sind
`get_mira_chat_messages` (Bubble), `cached_mira_chat_sessions_v1` und `dashboard_chats_v1`.

**Lesen:**

| Funktion | Felder |
|---|---|
| Chatliste mit Seiten | `id`, `title`, `updated_at`, **`is_pinned`, `project_id`, `project_title`**, `status`; dazu `next_offset`, `has_more`. `dashboard_chats_v1` trägt nur die ersten drei. Für Mira brauche ich eine Fassung mit allen Feldern (z. B. `mira_chats_v1(p_team, p_limit, p_offset)`). |
| Projekte | `id`, `title` |
| Nachrichten eines Chats | `id`, `role`, `status`, `content`, `content_html`, `created_at`, `latency_ms`, `metadata{evidence[], evidence_items[], opportunities[], actions[]}`. Bitte die Definition von `get_mira_chat_messages` und ob sie direkt mit Nutzer-JWT aufrufbar ist. |
| Einstellungen des Nutzers | `{brand, citation, response}` (Hervorhebungen) |

**Schreiben (einfache RPC):**
- Chat umbenennen, löschen, anheften/lösen, in Projekt verschieben (`chat_id`, `title`,
  `new_project_id`);
- Projekt anlegen (gibt die neue Zeile zurück), umbenennen, löschen;
- Projekt mit Chat anlegen;
- Einstellungen speichern.

**Lange Läufe (bleiben serverseitig, Regel 8):**
- Senden: `{chat_id ('' = neu), message, answer_detail (Medium|High|Ultra), model (pro|flash)}`.
  Heute löst Bubble damit n8n aus.
- Sprachnachricht: `{message_id, chat_id, audio_base64, mime_type, duration_ms}`, Transkription,
  dann ein Lauf.
- PDF-Export: `{assistant_message_id, session_id}`.

Frage dazu: Darf der Browser den Realtime-Kanal `mira_user_<uid>` selbst abonnieren (RLS bzw.
Autorisierung des Kanals)? Dann fällt der Bubble-Abo-Workflow weg.

### E. Team-Organisation

Die Liste aus `datenbank_auftrag.md` (Abschnitt Team) mit `[NAME ERFRAGEN]` gilt weiter:

| Aktion | Felder / Nutzlast | Art |
|---|---|---|
| Mitglieder | `user_id`, `email`, `display_name`, `role` (owner\|admin\|member), `joined_at`; dazu `viewer_role`, `viewer_user_id`, `viewer_email`, `permissions{can_invite, can_manage_roles, can_manage_members}` | Lesen |
| Offene Einladungen | `invite_id`, `invited_email`, `invited_role`, `expires_at`, `created_by_email`, `status` (nur offene). **Für `member` leer.** | Lesen |
| Protokoll | `created_at`, `event_type` (member_invited, invite_accepted, invite_revoked, member_removed, role_changed), `actor_email`, `target_email`, `meta{}`. **Für `member` leer.** | Lesen |
| Teams des Nutzers | `team_id`, `team_name`, `domain`, `logo_url`, `billing_plan`, `active_billing_plan`, `prompts_active`, `prompts_limit`, `competitors_tracked`, `competitors_limit`, `created_at` | Lesen |
| Einladen / erneut senden | `email`, `role` (member\|admin); `invite_id` | Schreiben **plus E-Mail**, also kein reiner RPC. Wer verschickt heute (Bubble, n8n, Edge)? |
| Einladung zurückziehen, Mitglied entfernen, Rolle ändern, Team verlassen | `invite_id`; `user_id`; `user_id` + `role` | Schreiben (RPC), Rechte serverseitig: Owner alles, Admin nur entfernen und zu Admin machen, nie der letzte Owner, nie die eigene Zeile |
| Team löschen | `team_id` | Schreiben; berührt das die Abrechnung (Stripe)? |
| Team wechseln, neues Team | `team_id` | **Wo steht das aktive Team?** Liegt es in einem Bubble-Nutzerfeld, bleibt der Wechsel vorerst bei Bubble. Bitte klären. |

---

## 3. Bestandsaufnahme (bitte die Ergebnisse schicken)

```sql
-- A) Funktionen, die nach diesen Bereichen klingen: Argumente, Rückgabe, Sicherheit, Team-Prüfung
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       pg_get_function_result(p.oid)            as returns,
       p.prosecdef                              as security_definer,
       position('require_team_access' in pg_get_functiondef(p.oid)) > 0 as prueft_team,
       position('auth.uid()' in pg_get_functiondef(p.oid)) > 0           as nutzt_uid
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app'
  and p.proname ~* '(radar|heatmap|performance|variation|opportunit|recommendation|research|suggest|mira|chat|session|project|team|member|invite|role)'
order by p.proname;

-- B) Rechte darauf
select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as darf
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join (select oid, rolname from pg_roles where rolname in ('anon','authenticated','service_role')) r
where n.nspname = 'app'
  and p.proname ~* '(radar|heatmap|performance|variation|opportunit|recommendation|research|suggest|mira|chat|session|project|team|member|invite|role)'
order by p.proname, r.rolname;

-- C) Tabellen dieser Bereiche mit Spalten
select table_name, string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position)
from information_schema.columns
where table_schema in ('app','public')
  and table_name ~* '(recommendation|research|suggest|mira|chat|session|project|team|member|invite|audit|log)'
group by table_name order by table_name;
```

Welche dieser Funktionen Bubble heute je Ansicht ruft, steht nur in Bubble
`[NAMEN ERFRAGEN, falls aus A nicht eindeutig]`. Für jede gefundene Funktion bitte:

1. die Definition;
2. ein echtes Beispiel (Hauptteam): die ersten 3 Zeilen und die Laufzeit (kalt und warm);
3. ob sie `p_team` gegen den angemeldeten Nutzer prüft;
4. was sie rechnet, das ein bestehender `_v1`-Vertrag schon rechnet.

---

## 4. Dein Vorschlag (noch nicht bauen)

1. **Je Ansicht** die Funktionen: Lesen, Schreiben, Start langer Läufe samt Stand-Abfrage. Je
   Funktion Parameter (Tabelle) und Antwortform mit einem echten Beispiel.
2. **Was aus einem bestehenden Vertrag kommt.** Zum Beispiel könnten die Performance-URLs
   `cached_citations_urls_v1` sein, die Opportunities lesen `dashboard_opportunities_v1`, und
   Mira-Chats eine erweiterte Fassung von `dashboard_chats_v1`.
3. **Caches:** Wo lohnt sich ein Cache wie bei Citations und Dashboard (Radar bei 90 Tagen, die
   Prompt-Research-Liste)? Wie wird „Aktualisieren“ abgebildet? Die Regel ist: jeder
   Aktualisieren-Knopf leert den DB-Cache seines Bereichs und lädt frisch, also je Bereich ein
   `clear_*_cache_v1`, wo es einen Cache gibt.
4. **Lange Läufe:** je einer Start, Stand und Ende, und wer sie ausführt.
5. **Offene Fragen,** die nur der Nutzer beantworten kann: aktives Team, E-Mail-Versand,
   Abrechnung beim Löschen, Realtime im Browser.

**Reihenfolge des Baus**, damit du priorisieren kannst:

1. A Performance (nur Lesen);
2. B Opportunities (Lesen da, zwei Schreib-RPCs);
3. E Team-Organisation;
4. C Prompt Research;
5. D Mira (der größte Teil).

Ich prüfe den Vorschlag gegen die Oberfläche und gebe ihn dir abgestimmt zurück. Erst dann baust du.
